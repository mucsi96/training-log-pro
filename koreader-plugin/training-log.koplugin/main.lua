local ConfirmBox = require("ui/widget/confirmbox")
local NetworkMgr = require("ui/network/manager")
local UIManager = require("ui/uimanager")
local InfoMessage = require("ui/widget/infomessage")
local WidgetContainer = require("ui/widget/container/widgetcontainer")
local logger = require("logger")
local _ = require("gettext")

local https = require("ssl.https")
local ltn12 = require("ltn12")
local json = require("json")

local OPEN_SYNC_DELAY_SECONDS = 5
local PAGE_TURN_SYNC_DELAY_SECONDS = 30
local PENDING_BOOKS_CHECK_DELAY_SECONDS = 10

local config_error_shown = false
local pending_books_checked = false

local TrainingLog = WidgetContainer:extend {
    name = "training-log",
    is_doc_only = false,
}

local function getPluginDir()
    local info = debug.getinfo(1, "S")
    return info.source:match("@?(.*/)") or "."
end

local function readFile(path)
    local file = io.open(path, "r")
    if not file then return nil end
    local content = file:read("*a")
    file:close()
    return content and content:match("^%s*(.-)%s*$")
end

local function loadConfig()
    local dir = getPluginDir()

    local configPath = dir .. "training-log.json"
    local configContent = readFile(configPath)
    if not configContent then
        return nil, "Config not found.\nPlace training-log.json next to the plugin."
    end

    local ok, config = pcall(json.decode, configContent)
    if not ok then
        return nil, "Invalid JSON in training-log.json:\n" .. tostring(config)
    end

    if not config.serverUrl then
        return nil, "serverUrl is missing in training-log.json."
    end

    local keyPath = dir .. "training-log.key"
    local apiKey = readFile(keyPath)
    if not apiKey then
        return nil, "API key not found.\nDownload training-log.key from the Devices page and place it next to the plugin."
    end
    config.apiKey = apiKey:gsub("\xEF\xBB\xBF", ""):gsub("%s+", "")

    return config, nil
end

local function postProgress(serverUrl, apiKey, requestBody)
    local requestJson = json.encode(requestBody)

    local responseBody = {}

    local _, code = https.request {
        url = serverUrl .. "/api/reading/koreader-sync",
        method = "POST",
        headers = {
            ["Content-Type"] = "application/json",
            ["Content-Length"] = tostring(#requestJson),
            ["Authorization"] = "Bearer " .. apiKey,
        },
        source = ltn12.source.string(requestJson),
        sink = ltn12.sink.table(responseBody),
    }

    if code ~= 204 then
        local raw = table.concat(responseBody)
        return false, code and ("HTTP " .. code .. ": " .. raw) or "Connection failed"
    end

    return true, nil
end

local function fetchPendingBooks(serverUrl, apiKey)
    local responseBody = {}

    local _, code = https.request {
        url = serverUrl .. "/api/device/books",
        method = "GET",
        headers = {
            ["Accept"] = "application/json",
            ["Authorization"] = "Bearer " .. apiKey,
        },
        sink = ltn12.sink.table(responseBody),
    }

    if code ~= 200 then
        return nil, code and ("HTTP " .. code) or "Connection failed"
    end

    local ok, books = pcall(json.decode, table.concat(responseBody))
    if not ok or type(books) ~= "table" then
        return nil, "Invalid response from server"
    end

    return books, nil
end

local function downloadBookFile(serverUrl, apiKey, bookId, targetPath)
    local file = io.open(targetPath, "wb")
    if not file then
        return false, "Cannot write to " .. targetPath
    end

    local _, code = https.request {
        url = serverUrl .. "/api/device/books/" .. bookId .. "/file",
        method = "GET",
        headers = {
            ["Authorization"] = "Bearer " .. apiKey,
        },
        sink = ltn12.sink.file(file),
    }

    if code ~= 200 then
        os.remove(targetPath)
        return false, code and ("HTTP " .. code) or "Connection failed"
    end

    return true, nil
end

local function acknowledgeBook(serverUrl, apiKey, bookId)
    local _, code = https.request {
        url = serverUrl .. "/api/device/books/" .. bookId,
        method = "DELETE",
        headers = {
            ["Authorization"] = "Bearer " .. apiKey,
        },
    }
    return code == 204
end

function TrainingLog:init()
    local config, configErr = loadConfig()
    self.config = config
    self.configErr = configErr
    self.current_page = nil
    self.last_synced_page = nil
    self.last_synced_total = nil
    self.scheduled_sync = nil

    if self.ui and self.ui.menu then
        self.ui.menu:registerToMainMenu(self)
    end

    if self.config and not pending_books_checked then
        pending_books_checked = true
        UIManager:scheduleIn(PENDING_BOOKS_CHECK_DELAY_SECONDS, function()
            self:checkPendingBooks(false)
        end)
    end
end

function TrainingLog:addToMainMenu(menu_items)
    menu_items.training_log = {
        text = _("Training Log: download pending books"),
        sorting_hint = "tools",
        callback = function()
            self:checkPendingBooks(true)
        end,
    }
end

function TrainingLog:checkPendingBooks(manual)
    if not self.config then
        if manual then
            UIManager:show(InfoMessage:new {
                text = "Training Log: " .. (self.configErr or "Not configured."),
            })
        end
        return
    end

    if not NetworkMgr:isOnline() then
        if manual then
            UIManager:show(InfoMessage:new {
                text = _("Training Log: no network connection."),
            })
        else
            logger.info("training-log: skipping pending books check, no network connection")
        end
        return
    end

    local books, err = fetchPendingBooks(self.config.serverUrl, self.config.apiKey)
    if not books then
        logger.warn("training-log: pending books check failed: " .. tostring(err))
        if manual then
            UIManager:show(InfoMessage:new {
                text = _("Training Log: could not check for pending books.") .. "\n" .. tostring(err),
            })
        end
        return
    end

    if #books == 0 then
        if manual then
            UIManager:show(InfoMessage:new {
                text = _("Training Log: no pending books."),
            })
        end
        return
    end

    if not self.config.booksDir then
        UIManager:show(InfoMessage:new {
            text = ("Training Log: %d book(s) waiting for this device, but booksDir is missing in training-log.json.")
                :format(#books),
        })
        return
    end

    local names = {}
    for _, book in ipairs(books) do
        table.insert(names, book.fileName)
    end

    UIManager:show(ConfirmBox:new {
        text = ("Training Log: %d book(s) waiting for this device:\n%s\n\nDownload to %s?")
            :format(#books, table.concat(names, "\n"), self.config.booksDir),
        ok_text = _("Download"),
        ok_callback = function()
            self:downloadBooks(books, self.config.booksDir)
        end,
    })
end

function TrainingLog:downloadBooks(books, dir_path)
    dir_path = dir_path:gsub("/+$", "")
    local downloaded = {}
    local failed = {}

    for _, book in ipairs(books) do
        local fileName = tostring(book.fileName):gsub("[/\\]", "_")
        local targetPath = dir_path .. "/" .. fileName
        local ok, err = downloadBookFile(
            self.config.serverUrl, self.config.apiKey, book.id, targetPath)
        if ok then
            acknowledgeBook(self.config.serverUrl, self.config.apiKey, book.id)
            table.insert(downloaded, fileName)
            logger.info("training-log: downloaded " .. fileName .. " to " .. dir_path)
        else
            table.insert(failed, fileName)
            logger.warn("training-log: download of " .. fileName .. " failed: " .. tostring(err))
        end
    end

    local message
    if #failed == 0 then
        message = ("Training Log: downloaded %d book(s) to\n%s"):format(#downloaded, dir_path)
    else
        message = ("Training Log: downloaded %d book(s), %d failed:\n%s")
            :format(#downloaded, #failed, table.concat(failed, "\n"))
    end
    UIManager:show(InfoMessage:new { text = message })
end

function TrainingLog:getBookInfo()
    local props = self.ui.document:getProps()
    local title = props.title
    if not title or title == "" then
        local path = self.ui.document.file or ""
        title = path:match("([^/]+)%.[^%.]+$") or path:match("([^/]+)$")
    end
    if not title or title == "" then
        return nil, nil
    end
    local author = props.authors
    if type(author) == "table" then
        author = table.concat(author, ", ")
    end
    if not author or author == "" then
        author = "Unknown"
    end
    return title, author
end

function TrainingLog:onReaderReady()
    if self.configErr then
        if not config_error_shown then
            config_error_shown = true
            UIManager:show(InfoMessage:new {
                text = "Training Log: " .. self.configErr,
            })
        end
        return
    end
    self.current_page = self.ui:getCurrentPage()
    self:scheduleSync(OPEN_SYNC_DELAY_SECONDS)
end

function TrainingLog:onPageUpdate(pageno)
    if type(pageno) ~= "number" then return end
    self.current_page = pageno
    self:scheduleSync(PAGE_TURN_SYNC_DELAY_SECONDS)
end

function TrainingLog:onEndOfBook()
    self:sync()
end

function TrainingLog:onSuspend()
    self:sync()
end

function TrainingLog:onCloseDocument()
    self:sync()
end

function TrainingLog:scheduleSync(delaySeconds)
    self:cancelScheduledSync()
    self.scheduled_sync = function()
        self.scheduled_sync = nil
        self:sync()
    end
    UIManager:scheduleIn(delaySeconds, self.scheduled_sync)
end

function TrainingLog:cancelScheduledSync()
    if self.scheduled_sync then
        UIManager:unschedule(self.scheduled_sync)
        self.scheduled_sync = nil
    end
end

function TrainingLog:sync()
    self:cancelScheduledSync()
    if not self.config or not self.ui or not self.ui.document then return end

    local total_pages = self.ui.document:getPageCount()
    local current_page = self.current_page or self.ui:getCurrentPage()
    if type(current_page) ~= "number" or type(total_pages) ~= "number" or total_pages < 1 then
        return
    end
    if current_page > total_pages then
        current_page = total_pages
    end
    if current_page == self.last_synced_page and total_pages == self.last_synced_total then
        return
    end

    local title, author = self:getBookInfo()
    if not title then
        logger.warn("training-log: skipping sync, book has no title")
        return
    end

    if not NetworkMgr:isOnline() then
        logger.info("training-log: skipping sync, no network connection")
        return
    end

    local ok, err = postProgress(self.config.serverUrl, self.config.apiKey, {
        title = title,
        author = author,
        totalPages = total_pages,
        currentPage = current_page,
    })

    if not ok then
        logger.warn("training-log: sync failed: " .. tostring(err))
        return
    end

    self.last_synced_page = current_page
    self.last_synced_total = total_pages
    logger.info("training-log: synced " .. title .. " at page "
        .. current_page .. " of " .. total_pages)
end

return TrainingLog

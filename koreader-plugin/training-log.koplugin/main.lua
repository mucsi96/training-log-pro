local NetworkMgr = require("ui/network/manager")
local UIManager = require("ui/uimanager")
local InfoMessage = require("ui/widget/infomessage")
local WidgetContainer = require("ui/widget/container/widgetcontainer")
local logger = require("logger")

local https = require("ssl.https")
local ltn12 = require("ltn12")
local json = require("json")

local OPEN_SYNC_DELAY_SECONDS = 5
local PAGE_TURN_SYNC_DELAY_SECONDS = 30

local config_error_shown = false

local TrainingLog = WidgetContainer:extend {
    name = "training-log",
    is_doc_only = true,
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

    local tokenPath = dir .. "training-log.token"
    local token = readFile(tokenPath)
    if not token then
        return nil, "Token not found.\nPlace training-log.token next to the plugin."
    end
    config.token = token:gsub("\xEF\xBB\xBF", ""):gsub("%s+", "")

    return config, nil
end

local function postProgress(serverUrl, token, requestBody)
    local requestJson = json.encode(requestBody)

    local responseBody = {}

    local _, code = https.request {
        url = serverUrl .. "/api/reading/koreader-sync",
        method = "POST",
        headers = {
            ["Content-Type"] = "application/json",
            ["Content-Length"] = tostring(#requestJson),
            ["Authorization"] = "Bearer " .. token,
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

function TrainingLog:init()
    local config, configErr = loadConfig()
    self.config = config
    self.configErr = configErr
    self.current_page = nil
    self.last_synced_page = nil
    self.last_synced_total = nil
    self.scheduled_sync = nil
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
    if not self.config or not self.ui.document then return end

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

    local ok, err = postProgress(self.config.serverUrl, self.config.token, {
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

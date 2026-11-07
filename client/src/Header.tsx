import { AppHeader, AppHeaderActions, Button, Menu, MenuItem, MenuPopover, MenuTrigger } from '@mucsi96/react-ui';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from './api';
import { profileSchema, coinsSchema } from './schemas';
import { Pomodoro } from './Pomodoro';
import styles from './Header.module.css';

export function Header() {
  const profile = useApi('/oauth2/userinfo', profileSchema);
  const coins = useApi('/api/coins', coinsSchema);
  const navigate = useNavigate();
  const name = profile.data?.additionalClaims?.name ?? profile.data?.preferredUsername ?? profile.data?.email;
  return (
    <AppHeader>
      <Link className={styles.brand} to="/">
        Tracker
      </Link>
      <AppHeaderActions>
        <Pomodoro />
        {profile.isError && (
          <Button variant="text" onPress={() => void profile.refetch()}>
            Retry profile
          </Button>
        )}
        {coins.isError && (
          <Button variant="text" onPress={() => void coins.refetch()}>
            Retry coins
          </Button>
        )}
        {coins.data && (
          <span
            className={styles.coins}
            role="status"
            aria-label={`Golden coins: ${coins.data.totalCoins} ${coins.data.totalCoins === 1 ? 'coin' : 'coins'}, ${coins.data.totalPoints} points`}
          >
            <span aria-hidden="true">●</span> {coins.data.totalPoints}
          </span>
        )}
        <MenuTrigger>
          <Button variant="avatar" aria-label="Open profile menu">
            {name
              ?.split(/\s+/)
              .map((word) => word[0])
              .join('')
              .toUpperCase()}
          </Button>
          <MenuPopover>
            <Menu aria-label={name ?? 'Profile'}>
              {name && <MenuItem isDisabled>{name}</MenuItem>}
              <MenuItem onAction={() => navigate('/settings')}>Settings</MenuItem>
              <MenuItem onAction={() => navigate('/devices')}>Devices</MenuItem>
            </Menu>
          </MenuPopover>
        </MenuTrigger>
      </AppHeaderActions>
    </AppHeader>
  );
}

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/components/Button';
import { NotificationsFeedManager } from '@/lib';

export const NotificationsButton = () => {
  const handleOpenNotificationsFeed = () => {
    NotificationsFeedManager.getInstance().openNotificationsFeed();
  };

  return (
    <Button
      onClick={handleOpenNotificationsFeed}
      className='inline-block rounded-lg px-3 py-2 text-center hover:no-underline my-0 text-white hover:bg-white hover:text-primary-darkBlue mx-0 transition-colors duration-200'
    >
      <FontAwesomeIcon icon={faBell} />
    </Button>
  );
};

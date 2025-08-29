// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { Button } from '@/components/Button';

export const GitHubButton = () => {
  return (
    <Button
      onClick={() => {
        window.open(
          'https://github.com/multiversx/mx-template-dapp-nextjs',
          '_blank'
        );
      }}
      className='inline-block rounded-lg px-3 py-2 text-center hover:no-underline my-0 text-white hover:bg-white hover:text-primary-darkBlue mx-0 transition-colors duration-200'
    >
      GitHub
    </Button>
  );
};

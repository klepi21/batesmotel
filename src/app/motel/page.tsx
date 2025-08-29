import { AuthRedirectWrapper } from '@/wrappers';
import { BatesMotel3D } from '@/components/ui/bates-motel-3d';

export default function MotelPage() {
  return (
    <AuthRedirectWrapper requireAuth={false}>
      <div className="min-h-screen bg-black">
        <BatesMotel3D />
      </div>
    </AuthRedirectWrapper>
  );
}


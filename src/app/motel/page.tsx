import { AuthRedirectWrapper } from '@/wrappers';
import { BatesMotel3D } from '@/components/ui/bates-motel-3d';
import Image from 'next/image';

export default function MotelPage() {
  return (
    <AuthRedirectWrapper requireAuth={false}>
      <div className="relative min-h-screen bg-black">
        {/* Background images: show mobile by default, swap to desktop on md+ */}
        <div className="absolute inset-0 -z-10">
          {/* Mobile */}
          <div className="md:hidden w-full h-full">
            <Image
              src="/assets/img/mob/jorkinAssetmob.png"
              alt="Motel background mobile"
              fill
              className="object-cover"
              priority
            />
          </div>
          {/* Desktop */}
          <div className="hidden md:block w-full h-full">
            <Image
              src="/assets/img/jorkinAsset.png"
              alt="Motel background desktop"
              fill
              className="object-cover"
              priority
            />
          </div>
        </div>

        <BatesMotel3D />
      </div>
    </AuthRedirectWrapper>
  );
}


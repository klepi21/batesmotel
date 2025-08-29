import { MvxCopyButton } from '@/lib/sdkDappUI/sdkDappUI.components';
import { MvxCopyButtonPropsType } from '@/lib/sdkDappUI/sdkDappUI.types';

export const CopyButton = ({
  className,
  text
}: Partial<MvxCopyButtonPropsType>) => {
  return (
    <MvxCopyButton
      class={className}
      text={text}
    />
  );
};

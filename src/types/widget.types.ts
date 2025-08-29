// import { TransactionsPropsType } from '@/app/dashboard/widgets/Transactions/types'; // Commented out missing import

export type WidgetType<T = Record<string, unknown>> = {
  title: string;
  widget: (props: T) => JSX.Element;
  description?: string;
  props?: { receiver?: string };
  reference: string;
  anchor?: string;
};

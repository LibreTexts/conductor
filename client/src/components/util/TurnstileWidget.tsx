import { Turnstile } from "@marsidev/react-turnstile";

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void;
}

const TurnstileWidget = (props: TurnstileWidgetProps) => {
  return (
    <Turnstile siteKey="0x4AAAAAAAQ3wOi31ZpBiURp" onSuccess={props.onSuccess} />
  );
};

export default TurnstileWidget;

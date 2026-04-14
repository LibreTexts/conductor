import { Button } from "@libretexts/davis-react";
import { IconSwitchHorizontal } from "@tabler/icons-react";
import { User } from "../../types";

interface SwitchAppProps {
    parent: "commons" | "conductor" | "support";
    user: User | null;
}

const SwitchApp: React.FC<SwitchAppProps> = ({ parent, user }) => {

    const getSwitchToApp = (): { label: string; href: string } => {
        if (parent === "conductor") {
            return { label: "Commons", href: "/" };
        } else if (parent === "support") {
            if (user && user.isAuthenticated) {
                return { label: "Conductor", href: "/home" };
            }
        } else if (parent === "commons") {
            if (user && user.isAuthenticated) {
                return { label: "Conductor", href: "/home" };
            }
        }

        // Default case (from Commons or if support user not authenticated) is to switch to Commons
        return { label: "Commons", href: "/" };
    }

    const switchToApp = getSwitchToApp();

    if (parent === "commons" && !user?.isAuthenticated) {
        // Don't show switch app button in Commons if user not authenticated, since the only destination is Conductor which also requires authentication
        return null;
    }

    return (
        <div className="flex items-center gap-4">
            <Button
                onClick={() => {
                    window.location.href = switchToApp.href;
                }}
                aria-label={`Back to ${switchToApp.label}`}
                icon={<IconSwitchHorizontal className="pb-1!" />}
                iconPosition="left"
                fullWidth
            >
                {switchToApp.label}
            </Button>
        </div>
    );
}

export default SwitchApp;
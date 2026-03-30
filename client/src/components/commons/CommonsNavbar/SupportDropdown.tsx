import useClientConfig from "../../../hooks/useClientConfig";
import { Menu, MenuItemProps } from "@libretexts/davis-react";

interface SupportDropdownProps {
    isMobile?: boolean;
}

const SupportDropdown: React.FC<SupportDropdownProps> = ({ isMobile = false }) => {
    const { clientConfig } = useClientConfig();

    const itemsArr: MenuItemProps[] = [
        {
            children: "Insight - Knowledge Base",
            onClick() {
                window.open(`${clientConfig?.main_commons_url || "https://commons.libretexts.org"}/insight`, "_blank", "noopener,noreferrer");
            },
        },
        {
            children: "System Status",
            onClick() {
                window.open("https://status.libretexts.org", "_blank", "noopener,noreferrer");
            },
        },
        {
            children: "Contact Support",
            onClick() {
                window.open(`${clientConfig?.main_commons_url || "https://commons.libretexts.org"}/support/contact`, "_blank", "noopener,noreferrer");
            },
        },
    ]

    return (
        <Menu>
            <Menu.Button>
                Support
            </Menu.Button>
            <Menu.Items>
                {itemsArr.map((item) => (
                    <Menu.Item {...item} />
                ))}
            </Menu.Items>
        </Menu>
    );
};

export default SupportDropdown;

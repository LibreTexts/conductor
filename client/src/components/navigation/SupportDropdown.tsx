import useClientConfig from "../../hooks/useClientConfig";
import { getCommonsBaseURL } from "../../utils/misc";
import { Menu, MenuItemProps } from "@libretexts/davis-react";

interface SupportDropdownProps { }

const SupportDropdown: React.FC<SupportDropdownProps> = () => {
    const { clientConfig } = useClientConfig();

    const itemsArr: MenuItemProps[] = [
        {
            children: "Insight - Knowledge Base",
            onClick() {
                window.open(`${getCommonsBaseURL(clientConfig)}/insight`, "_blank", "noopener,noreferrer");
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
                window.open(`${getCommonsBaseURL(clientConfig)}/support/contact`, "_blank", "noopener,noreferrer");
            },
        },
    ]

    return (
        <Menu>
            <Menu.Button className="!w-full !nav:w-auto">
                Support
            </Menu.Button>
            <Menu.Items className="z-[10000]!">
                {itemsArr.map((item) => (
                    <Menu.Item {...item} />
                ))}
            </Menu.Items>
        </Menu>
    );
};

export default SupportDropdown;

import { Dropdown, Icon, Menu, } from "semantic-ui-react";
import { useState } from "react";


interface SupportDropdownProps {
    isMobile?: boolean;
}

const SupportDropdown: React.FC<SupportDropdownProps> = ({ isMobile = false }) => {
    const [mouseIndex, setMouseIndex] = useState(0);

    const itemsArr = [
        {
            name: "Knowledge Base",
            props: {
                key: "libretexts",
                as: "a",
                href: "https://commons.libretexts.org/insight",
                target: "_blank",
                rel: "noopener noreferrer",
            },
        },
        {
            name: 'System Status',
            props: {
                key: "status",
                as: "a",
                href: "https://status.libretexts.org",
                target: "_blank",
                rel: "noopener noreferrer",
            },
        },
        {
            name: "Contact Support",
            props: {
                key: "contact",
                as: "a",
                href: "https://commons.libretexts.org/support/contact",
                target: "_blank",
                rel: "noopener noreferrer",
            },
        },
    ]

    if (isMobile) {
        return (
            <Menu.Menu className="commons-mobilenav-commonslist">
                {itemsArr.map((item) => (
                    <Menu.Item {...item.props}>
                        {/* <Icon name="university" /> */}
                        {item.name}
                    </Menu.Item>
                ))}
            </Menu.Menu>
        );
    }

    const handleKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'ArrowDown') {
            setMouseIndex((prevIndex) => Math.min(prevIndex + 1, itemsArr.length - 1));
            const element = document.getElementById("active");
            if (element) {
                element?.scrollIntoView({
                    behavior: "auto",
                    block: "start"
                });
            }
        } else if (e.key === 'ArrowUp') {
            setMouseIndex((prevIndex) => Math.max(prevIndex - 1, 0));
            const element = document.getElementById("active");
            if (element) {
                element?.scrollIntoView({
                    behavior: "auto",
                    block: "start"
                });
            }
        } else if (e.key == "Enter") {
            window.location.href = itemsArr[mouseIndex].props.href;
        }
    };



    return (
        <div onKeyDown={handleKeyPress} className="flex flex-row items-center" >
            <Dropdown item text="Support">
                <Dropdown.Menu direction="left" className="commons-desktopnav-commonslist"  >
                    {itemsArr.map((item, index) => (
                        <Dropdown.Item {...item.props} selected={index == mouseIndex} id={index == mouseIndex ? "active" : "inactive"}  >
                            {/* <Icon name="university" /> */}
                            {item.name}
                        </Dropdown.Item>
                    ))}
                </Dropdown.Menu>
            </Dropdown>
        </div>
    );
};

export default SupportDropdown;

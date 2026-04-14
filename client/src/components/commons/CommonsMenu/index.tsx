import { Link } from "react-router-dom";
import { useTypedSelector } from "../../../state/hooks";
import { sanitizeCustomColor } from "../../../utils/campusSettingsHelpers";

/**
 * A navigation bar providing route-level navigation around the Commons interfaces.
 *
 * Renders as a <nav> landmark with <ul>/<li> link structure so screen readers
 * correctly identify it as site navigation (not a tablist). Active page is
 * communicated via aria-current="page" rather than a CSS class, and every item
 * carries an explicit focus-visible ring that works against any org brand color.
 */
const CommonsMenu = ({ activeItem = "catalog" }: { activeItem?: string }) => {
  const org = useTypedSelector((state) => state.org);

  const generateMenuOptions = (): { key: string; text: string }[] => {
    const opts: { key: string; text: string }[] = [{ key: "catalog", text: "Catalog" }];

    if (org.showCollections === undefined || org.showCollections) {
      opts.push({ key: "collections", text: org.collectionsDisplayLabel ?? "Collections" });
    }

    if (org.orgID === "libretexts") {
      opts.push({ key: "homework", text: "Homework" });
    }

    return opts;
  };

  const options = generateMenuOptions();
  if (options.length <= 1) return <></>;

  const bgColor = sanitizeCustomColor(org.primaryColor ?? "#127BC4");

  return (
    <nav
      aria-label="Commons navigation"
      className="w-full shadow-md"
      style={{ backgroundColor: bgColor }}
    >
      <ul role="list" className="flex flex-wrap justify-center m-0 p-0 list-none">
        {options.map((item) => {
          const isActive = activeItem === item.key;
          return (
            <li key={item.key}>
              <Link
                to={`/${item.key}`}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "inline-flex items-center px-6 py-3",
                  "!text-white text-xl font-medium no-underline",
                  "border-b-2 transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2",
                  "focus-visible:ring-white focus-visible:ring-inset focus-visible:rounded-sm",
                  isActive ? "border-white" : "border-transparent hover:border-white/50",
                ].join(" ")}
              >
                {item.text}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default CommonsMenu;

import { useEffect } from "react";
import { Breadcrumb, Heading, Stack, Link, Text } from "@libretexts/davis-react";
import { useTypedSelector } from "../../../state/hooks";

/**
 * Public HTML sitemap for Commons. Provides a second discovery mechanism
 * (alongside CommonsMenu) so every public page in the related set is
 * reachable by at least two independent ways (WCAG 2.4.5).
 */
const CommonsSitemap = () => {
  const org = useTypedSelector((state) => state.org);
  const isLibreTexts = org.orgID === "libretexts";
  const collectionsLabel = org.collectionsDisplayLabel ?? "Collections";
  const showCollections =
    org.showCollections === undefined || org.showCollections;

  useEffect(() => {
    document.title = `${org.shortName !== "LibreTexts" ? `${org.shortName} Commons` : "LibreCommons"
      } | Sitemap`;
  }, [org.shortName]);

  const browseLinks: { to: string; label: string }[] = [
    { to: "/catalog", label: "Catalog" },
    { to: "/catalog?active_tab=books", label: "Catalog — Books" },
    { to: "/catalog?active_tab=assets", label: "Catalog — Assets" },
    { to: "/catalog?active_tab=authors", label: "Catalog — Authors" },
    { to: "/catalog?active_tab=projects", label: "Catalog — Projects" },
    { to: "/catalog?active_tab=minirepos", label: "Catalog — Mini-repos" },
  ];
  if (showCollections) {
    browseLinks.push({ to: "/collections", label: collectionsLabel });
  }
  if (isLibreTexts) {
    browseLinks.push({ to: "/homework", label: "Homework" });
  }

  const aboutLinks: { href: string; label: string; external?: boolean }[] = [
    { href: "/support", label: "Contact Us" },
    { href: "/accessibility", label: "Accessibility" },
    { href: "/sitemap", label: "Sitemap" },
    { href: "/store", label: "Store" }
  ];
  if (isLibreTexts) {
    aboutLinks.push(
      {
        href: "https://libretexts.org/privacy",
        label: "Legal",
        external: true,
      },
      {
        href: "https://status.libretexts.org",
        label: "Status",
        external: true,
      },
      {
        href: "https://donate.libretexts.org",
        label: "Donate",
        external: true,
      }
    );
  }

  return (
    <>
      <div className="px-6 py-3 border-b border-neutral-200">
        <Breadcrumb>
          <Breadcrumb.Item href="/catalog">Catalog</Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>Sitemap</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      <Stack direction="vertical" gap="lg" className="p-6 max-w-4xl mx-auto">
        <Heading level={1}>Sitemap</Heading>
        <Text>
          A directory of public pages in {org.name ?? "the"} Commons. Individual
          books, authors, projects, and files are not listed here - browse them
          from the Catalog or use the breadcrumb on any detail page to navigate
          back.
        </Text>

        <nav aria-labelledby="sitemap-browse">
          <Heading level={2} id="sitemap-browse">
            Browse
          </Heading>
          <Text>
            Browse the Commons by category:
          </Text>
          <ul className="list-disc pl-6 m-0">
            {browseLinks.map((item) => (
              <li key={item.to} className="my-1">
                <Link href={item.to}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="sitemap-about">
          <Heading level={2} id="sitemap-about">
            About and Support
          </Heading>
          <ul className="list-disc pl-6 m-0">
            {aboutLinks.map((item) => (
              <li key={item.href} className="my-1">
                <Link
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                  external={item.external}
                  underline="always"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Stack>
    </>
  );
};

export default CommonsSitemap;

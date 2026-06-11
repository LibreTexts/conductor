import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTypedSelector } from "../../../../state/hooks";
import {
  Breadcrumb,
  Heading,
  Stack,
  Text,
} from "@libretexts/davis-react";
import {
  IconChevronRight,
  IconEdit,
} from "@tabler/icons-react";
import useDocumentTitle from "../../../../hooks/useDocumentTitle";

type BookBotListItem = {
  url: string;
  icon: React.ReactNode;
  title: string;
  description: string;
};

const bookBots: BookBotListItem[] = [
  {
    url: "/controlpanel/book-bots/editor-preprocess",
    icon: <IconEdit size={20} />,
    title: "Editor Preprocess",
    description:
      "Preprocess a LibreTexts book tree to prepare pages for the CKEditor migration.",
  },
];

const BookBots = () => {
  useDocumentTitle("LibreTexts Conductor | Book Bots");
  const user = useTypedSelector((state) => state.user);

  useEffect(() => {
    if (!user || !user.uuid) return;
    if (!user.isSuperAdmin) {
      window.location.href = "/home";
    }
  }, [user]);

  if (!user.isSuperAdmin) return null;

  return (
    <div className="!pt-32 !bg-white !h-full !px-8">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>Book Bots</Heading>
        <Breadcrumb>
          <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>Book Bots</Breadcrumb.Item>
        </Breadcrumb>
        <Text>
          Trigger and monitor automated book-processing bots. Pick a bot below to
          run a new job or review past runs.
        </Text>
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          {bookBots.map((item, idx) => (
            <Link
              key={idx}
              to={item.url}
              className="flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center gap-4">
                <div className="text-primary">{item.icon}</div>
                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-gray-600">{item.description}</div>
                </div>
              </div>
              <IconChevronRight size={18} className="text-gray-400" />
            </Link>
          ))}
        </div>
      </Stack>
    </div>
  );
};

export default BookBots;

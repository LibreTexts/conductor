import AuthHelper from "../util/AuthHelper";
import { useTypedSelector } from "../../state/hooks";
import useClientConfig from "../../hooks/useClientConfig";
import { Avatar, Menu, Stack, Text } from "@libretexts/davis-react";
import { IconLock, IconLogout, IconUser } from "@tabler/icons-react";

interface UserDropdownProps {
  showAvatar?: boolean;
  dropdown?: boolean;
  className?: string;
}

const UserDropdown: React.FC<UserDropdownProps> = ({
  showAvatar = true,
}) => {
  const user = useTypedSelector((state) => state.user);
  const { clientConfig } = useClientConfig();
  const centralIdentityBaseUrl = clientConfig?.central_identity_base_url || "";

  return (
    <Menu>
      <Menu.Button className="!max-h-[36px] !w-full xl:!w-auto">
        {showAvatar && <Avatar src={`${user.avatar}`} name={`${user.firstName} ${user.lastName}`} size="xs" />}
        <Text size="sm" className="text-white">
          {user.firstName} {user.lastName}
        </Text>
      </Menu.Button>
      <Menu.Items>
        <Menu.Item
          onClick={() => window.open(
            `${centralIdentityBaseUrl}/profile`,
            "_blank",
            "noopener noreferrer"
          )}
          children={(
            <Stack direction="horizontal" gap="sm" align="center">
              <IconUser />
              <Text>
                Profile ({user.email})
              </Text>
            </Stack>
          )}
        />
        <Menu.Item
          onClick={
            () => window.open(
              `${centralIdentityBaseUrl}/security`,
              "_blank",
              "noopener noreferrer"
            )
          }
          children={(
            <Stack direction="horizontal" gap="sm" align="center">
              <IconLock />
              <Text>
                Security
              </Text>
            </Stack>
          )}
        />
        <Menu.Item
          onClick={() => AuthHelper.logout()}
          children={(
            <Stack direction="horizontal" gap="sm" align="center">
              <IconLogout />
              <Text>
                Log out
              </Text>
            </Stack>
          )}
        />
      </Menu.Items>
    </Menu>
  );
};

export default UserDropdown;

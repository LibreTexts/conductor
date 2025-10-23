import { GenericKeyTextValueObj } from '../types';

export const UserRoleOptions: GenericKeyTextValueObj<string>[] = [
  {
    key: "member",
    text: "Member",
    value: "member",
  },
  {
    key: "campusadmin",
    text: "Campus Admin",
    value: "campusadmin",
  },
  {
    key: "harvester",
    text: "Harvester",
    value: "harvester",
  },
  {
    key: "superadmin",
    text: "Super Admin",
    value: "superadmin",
  },
];
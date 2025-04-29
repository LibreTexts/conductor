export interface Library {
  subdomain: string;
  title: string;
  link: string;
  thumbnail: string;
  glyphURL?: string;
  centralIdentityAppId: number;
  hidden: boolean;
  syncSupported: boolean;
}

import type { AccessType } from "@/db/schema";

export const ACCESS_TYPE_LABELS: Record<AccessType, string> = {
  hosting: "Hosting",
  dominio: "Dominio",
  wordpress: "WordPress",
  ftp: "FTP / SFTP",
  base_datos: "Base de datos",
  email: "Email",
  analytics: "Analytics",
  redes: "Redes sociales",
  otro: "Otro",
};

export const ACCESS_TYPES = Object.keys(ACCESS_TYPE_LABELS) as AccessType[];

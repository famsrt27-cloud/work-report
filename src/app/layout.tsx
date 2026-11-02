import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ระบบรายงานการปฏิบัติงาน", template: "%s | ระบบรายงานการปฏิบัติงาน" },
  description: "ระบบบันทึกงานเจ้าหน้าที่และจัดทำรายงานผลการปฏิบัติงาน",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}

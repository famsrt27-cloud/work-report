import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-noto-sans-thai",
});

export const metadata: Metadata = {
  title: { default: "ระบบรายงานการปฏิบัติงาน", template: "%s | ระบบรายงานการปฏิบัติงาน" },
  description: "ระบบบันทึกงานเจ้าหน้าที่และจัดทำรายงานผลการปฏิบัติงาน",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th" className={notoSansThai.variable}><body>{children}</body></html>;
}

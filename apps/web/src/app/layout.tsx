import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Malayalam, Poppins } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const malayalam = Noto_Sans_Malayalam({ variable: "--font-ml", subsets: ["malayalam"], weight: ["400", "500", "600", "700"] });
const poppins = Poppins({ variable: "--font-head", subsets: ["latin"], weight: ["500", "600", "700"] });

// Every page reads D1 at request time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.giokerala.org"),
  title: { default: "GIO Kerala | Girls Islamic Organization", template: "%s | GIO Kerala" },
  description: "Girls Islamic Organization (GIO) Kerala: Islamic students' and young women's organisation in Kerala.",
  icons: {
    icon: [
      { url: "/wp-content/uploads/2025/03/cropped-icon-32x32.png", sizes: "32x32" },
      { url: "/wp-content/uploads/2025/03/cropped-icon-192x192.png", sizes: "192x192" },
    ],
    apple: "/wp-content/uploads/2025/03/cropped-icon-180x180.png",
  },
};

export const viewport: Viewport = { themeColor: "#185c9a" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-scroll-behavior: Next.js turns smooth scrolling off during route changes (globals.css sets it on html).
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${malayalam.variable} ${poppins.variable} antialiased`}>
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}

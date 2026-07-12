import type { Metadata, Viewport } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { BrandProvider } from "@/lib/brand";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
// Display face for marketing surfaces only (a real contrast axis vs. Inter body).
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Leuk",
  description: "Practice management and EHR for healthcare professionals.",
};

// Set data-brand before paint so the toggle's choice (and default) is applied
// without a flash. Mirrors the theme's pre-hydration pattern.
const BRAND_INIT = `(function(){try{var b=localStorage.getItem('brand');document.documentElement.setAttribute('data-brand',b==='liminal'?'liminal':'leuk');}catch(e){}})();`;

// viewport-fit=cover lets the app shell own the iPhone safe areas
// (status bar / home indicator) instead of Safari padding them.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BRAND_INIT }} />
      </head>
      <body className="font-sans">
        <BrandProvider>
          <ToastProvider>{children}</ToastProvider>
        </BrandProvider>
      </body>
    </html>
  );
}

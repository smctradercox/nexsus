import QRCode from "qrcode";
import NexusDashboard from "@/components/nexus-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const walletAddress = process.env.USDT_TRC20_WALLET ?? "";
  const walletQr = walletAddress
    ? await QRCode.toDataURL(walletAddress, {
        width: 176,
        margin: 1,
        color: { dark: "#d8fff7", light: "#101c27" },
      })
    : "";

  return <NexusDashboard walletAddress={walletAddress} walletQr={walletQr} />;
}

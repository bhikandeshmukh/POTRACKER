"use client";
import { useEffect } from "react";

type Props = {
  className?: string;
  adSlot?: string; // your ad unit id
  style?: React.CSSProperties;
  adFormat?: string;
  adClient?: string;
  test?: boolean; // set true to force test ads (data-adtest="on")
};

export default function GoogleAd({
  adSlot,
  adFormat = "auto",
  adClient,
  className,
  style,
  test = false,
}: Props) {
  const client = adClient || process.env.NEXT_PUBLIC_ADSENSE_ID;

  useEffect(() => {
    try {
      // push to adsbygoogle to render the ad
      (window as any).adsbygoogle = (window as any).adsbygoogle || [];
      (window as any).adsbygoogle.push({});
    } catch (e) {
      // ignore
    }
  }, []);

  return (
    <ins
      className={`adsbygoogle ${className || ""}`.trim()}
      style={style || { display: "block" }}
      data-ad-client={client}
      data-ad-slot={adSlot}
      data-ad-format={adFormat}
      data-full-width-responsive="true"
      data-adtest={test ? "on" : undefined}
    ></ins>
  );
}

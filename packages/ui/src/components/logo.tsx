import * as React from "react";

export interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  size?: number;
}

export const Logo = React.forwardRef<HTMLImageElement, LogoProps>(
  ({ size = 48, className, alt = "Shoraka Logo", ...props }, ref) => {
    return (
      <img
        ref={ref}
        src="/logo.svg"
        alt={alt}
        height={size}
        style={{ height: size, width: "auto" }}
        className={className}
        {...props}
      />
    );
  }
);

Logo.displayName = "Logo";

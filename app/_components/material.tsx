"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { Button, type ButtonProps } from "@material-tailwind/react/dist/components/button";

export { Button };
export { Card } from "@material-tailwind/react/dist/components/card";
export { Input } from "@material-tailwind/react/dist/components/input";
export { Navbar } from "@material-tailwind/react/dist/components/navbar";
export { Textarea } from "@material-tailwind/react/dist/components/textarea";

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "as" | "color"> &
  Pick<ButtonProps, "variant" | "color" | "isPill" | "size">;

export function ButtonLink(props: ButtonLinkProps) {
  return <Button as={Link} {...props} />;
}

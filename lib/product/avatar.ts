export const avatars = [
  { label: "Toast", image: "/images/toast.jpg" },
  { label: "Pasta", image: "/images/pasta.jpg" },
  { label: "Pancakes", image: "/images/pancakes.jpg" },
  { label: "Salad", image: "/images/salad.jpg" },
];

export function publicAvatarImage(image: string | null | undefined) {
  if (!image) return null;
  if (avatars.some(avatar => avatar.image === image)) return image;
  if (/^\/api\/images\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(image)) return image;
  // Previous profiles can contain arbitrary URLs submitted via the auth API.
  if (/^https:\/\/lh[0-9]+\.googleusercontent\.com\/[^\s\\]+$/.test(image)) return image;
  return null;
}

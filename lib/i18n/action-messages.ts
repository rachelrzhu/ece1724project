import type { Messages } from "@/lib/i18n";

export const actionMessages = {
  "Too many changes in a short time. Please try again later.": ["短时间内修改次数过多，请稍后重试。", "Trop de modifications en peu de temps. Veuillez réessayer plus tard."],
  "The photo upload limit has been reached. Please try again later.": ["已达到照片上传次数上限，请稍后重试。", "La limite de téléversement de photos est atteinte. Veuillez réessayer plus tard."],
  "Your account has reached its image storage limit.": ["你的账户已达到图片存储上限。", "La limite de stockage d’images de votre compte est atteinte."],
  "Image storage is full. You can still save recipes without a new photo.": ["图片存储空间已满。你仍可保存不含新照片的食谱。", "Le stockage d’images est plein. Vous pouvez toujours enregistrer une recette sans ajouter de photo."],
} as const satisfies Messages;

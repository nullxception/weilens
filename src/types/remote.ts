import { z } from "zod";

export const UserSchema = z.object({
  id: z.number(),
  idstr: z.string(),
  screen_name: z.string(),
  profile_image_url: z.string().optional(),
  profile_url: z.string().optional(),
  avatar_large: z.string().optional(),
  avatar_hd: z.string().optional(),
});

export const PicDimensionSchema = z.object({
  url: z.string(),
  width: z.number(),
  height: z.number(),
});

export const PicInfoSchema = z.object({
  thumbnail: PicDimensionSchema.nullish(),
  bmiddle: PicDimensionSchema.nullish(),
  large: PicDimensionSchema.nullish(),
  original: PicDimensionSchema.nullish(),
  largest: PicDimensionSchema.nullish(),
  mw2000: PicDimensionSchema.nullish(),
  largecover: PicDimensionSchema.nullish(),
  pic_id: z.string(),
  type: z.string().nullish(),
  video: z.string().optional().nullish(),
});

export const PostTagSchema = z.object({
  tag_name: z.string(),
  otype: z.string().optional(),
});

export const PostSchema = z.object({
  created_at: z.string(),
  id: z.number(),
  idstr: z.string(),
  mblogid: z.string(),
  user: UserSchema.optional(),
  pic_ids: z.array(z.string()).optional(),
  pic_num: z.number().optional(),
  pic_infos: z.record(z.string(), PicInfoSchema).optional(),
  reposts_count: z.number().optional(),
  comments_count: z.number().optional(),
  attitudes_count: z.number().optional(),
  text: z.string(),
  region_name: z.string().optional(),
  tag_struct: z.array(PostTagSchema).optional(),
});

export const BlogDataSchema = z.object({
  since_id: z.string().optional(),
  list: z.array(PostSchema),
});

export const BlogResponseSchema = z.object({ data: BlogDataSchema });

export type User = z.infer<typeof UserSchema>;
export type PicDimension = z.infer<typeof PicDimensionSchema>;
export type PicInfo = z.infer<typeof PicInfoSchema>;
export type BlogPost = z.infer<typeof PostSchema>;
export type BlogData = z.infer<typeof BlogDataSchema>;
export type BlogResponse = z.infer<typeof BlogResponseSchema>;

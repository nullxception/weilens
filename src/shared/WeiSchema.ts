import { z } from "zod"

export const VisibleSchema = z.object({
  type: z.number(),
  list_id: z.number(),
})

export const StatusTotalCounterSchema = z.object({
  total_cnt_format: z.union([z.string(), z.number()]).optional(),
  comment_cnt: z.string().optional(),
  repost_cnt: z.string().optional(),
  like_cnt: z.string().optional(),
  total_cnt: z.string().optional(),
})

export const UserIconSchema = z.object({
  type: z.string(),
  data: z
    .object({
      mbrank: z.number().optional(),
      mbtype: z.number().optional(),
      svip: z.number().optional(),
      vvip: z.number().optional(),
    })
    .optional(),
})

export const UserSchema = z.object({
  id: z.number(),
  idstr: z.string(),
  pc_new: z.number().optional(),
  screen_name: z.string(),
  profile_image_url: z.string().optional(),
  profile_url: z.string().optional(),
  verified: z.boolean().optional(),
  verified_type: z.number().optional(),
  domain: z.string().optional(),
  weihao: z.string().optional(),
  verified_type_ext: z.number().optional(),
  status_total_counter: StatusTotalCounterSchema.optional(),
  avatar_large: z.string().optional(),
  avatar_hd: z.string().optional(),
  follow_me: z.boolean().optional(),
  following: z.boolean().optional(),
  mbrank: z.number().optional(),
  mbtype: z.number().optional(),
  v_plus: z.number().optional(),
  user_ability: z.number().optional(),
  planet_video: z.boolean().optional(),
  icon_list: z.array(UserIconSchema).optional(),
})

export const FocusPointSchema = z.object({
  left: z.number(),
  top: z.number(),
  width: z.number(),
  height: z.number(),
})

export const PicFocusPointSchema = z.object({
  focus_point: FocusPointSchema,
  pic_id: z.string(),
})

export const PicDimensionSchema = z.object({
  url: z.string(),
  width: z.number(),
  height: z.number(),
  cut_type: z.number().nullish(),
  type: z.string().nullish(),
})

export const PicInfoSchema = z.object({
  thumbnail: PicDimensionSchema.nullish(),
  bmiddle: PicDimensionSchema.nullish(),
  large: PicDimensionSchema.nullish(),
  original: PicDimensionSchema.nullish(),
  largest: PicDimensionSchema.nullish(),
  mw2000: PicDimensionSchema.nullish(),
  largecover: PicDimensionSchema.nullish(),
  focus_point: FocusPointSchema.nullish(),
  object_id: z.string().nullish(),
  pic_id: z.string(),
  photo_tag: z.number().nullish(),
  type: z.string().nullish(),
  video: z.string().optional().nullish(),
  pic_status: z.number().nullish(),
})

export const NumberDisplayStrategySchema = z.object({
  apply_scenario_flag: z.number(),
  display_text_min_number: z.number(),
  display_text: z.string(),
})

export const CommentManageInfoSchema = z.object({
  comment_permission_type: z.number(),
  approval_comment_type: z.number(),
  comment_sort_type: z.number().optional(),
})

export const WeiPostTagSchema = z.object({
  tag_name: z.string(),
  otype: z.string().optional(),
})

export const WeiPostSchema = z.object({
  visible: VisibleSchema.optional(),
  created_at: z.string(),
  id: z.number(),
  idstr: z.string(),
  mid: z.string(),
  mblogid: z.string(),
  user: UserSchema.optional(),
  textLength: z.number().optional(),
  source: z.string().optional(),
  rid: z.string().optional(),
  cardid: z.string().optional(),
  pic_ids: z.array(z.string()).optional(),
  pic_focus_point: z.array(PicFocusPointSchema).optional(),
  pic_num: z.number().optional(),
  pic_infos: z.record(z.string(), PicInfoSchema).optional(),
  pic_bg_new: z.string().nullish(),
  mblog_vip_type: z.number().optional(),
  number_display_strategy: NumberDisplayStrategySchema.optional(),
  reposts_count: z.number().optional(),
  comments_count: z.number().optional(),
  attitudes_count: z.number().optional(),
  attitudes_status: z.number().optional(),
  text: z.string(),
  region_name: z.string().optional(),
  tag_struct: z.array(WeiPostTagSchema).optional(),
})

export const WeiDataSchema = z.object({
  since_id: z.string().optional(),
  list: z.array(WeiPostSchema),
  status_visible: z.number().optional(),
  bottom_tips_visible: z.boolean().optional(),
  bottom_tips_text: z.string().optional(),
  topicList: z.array(z.any()).optional(),
  total: z.union([z.string(), z.number()]).optional(),
})

export const WeiResponseSchema = z.object({
  data: WeiDataSchema,
  ok: z.number(),
})

export type Visible = z.infer<typeof VisibleSchema>
export type StatusTotalCounter = z.infer<typeof StatusTotalCounterSchema>
export type UserIcon = z.infer<typeof UserIconSchema>
export type User = z.infer<typeof UserSchema>
export type FocusPoint = z.infer<typeof FocusPointSchema>
export type PicFocusPoint = z.infer<typeof PicFocusPointSchema>
export type PicDimension = z.infer<typeof PicDimensionSchema>
export type PicInfo = z.infer<typeof PicInfoSchema>
export type NumberDisplayStrategy = z.infer<typeof NumberDisplayStrategySchema>
export type CommentManageInfo = z.infer<typeof CommentManageInfoSchema>
export type WeiPost = z.infer<typeof WeiPostSchema>
export type WeiData = z.infer<typeof WeiDataSchema>
export type WeiResponse = z.infer<typeof WeiResponseSchema>

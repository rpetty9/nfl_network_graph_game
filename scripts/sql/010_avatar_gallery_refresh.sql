ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS avatar_border TEXT NOT NULL DEFAULT 'slate';

ALTER TABLE app_user
  DROP CONSTRAINT IF EXISTS app_user_avatar_style_check;

ALTER TABLE app_user
  DROP CONSTRAINT IF EXISTS app_user_avatar_bg_check;

ALTER TABLE app_user
  DROP CONSTRAINT IF EXISTS app_user_avatar_accent_check;

ALTER TABLE app_user
  DROP CONSTRAINT IF EXISTS app_user_avatar_border_check;

ALTER TABLE app_user
  ADD CONSTRAINT app_user_avatar_style_check
  CHECK (
    avatar_style IN (
      'helmet',
      'star',
      'bolt',
      'crest',
      'crown',
      'diamond',
      'comet',
      'target',
      'orbit',
      'flame',
      'moon',
      'prism'
    )
  );

ALTER TABLE app_user
  ADD CONSTRAINT app_user_avatar_bg_check
  CHECK (avatar_bg IN ('sky', 'emerald', 'amber', 'rose', 'slate', 'violet'));

ALTER TABLE app_user
  ADD CONSTRAINT app_user_avatar_accent_check
  CHECK (avatar_accent IN ('sky', 'emerald', 'amber', 'rose', 'slate', 'violet'));

ALTER TABLE app_user
  ADD CONSTRAINT app_user_avatar_border_check
  CHECK (avatar_border IN ('sky', 'emerald', 'amber', 'rose', 'slate', 'violet'));

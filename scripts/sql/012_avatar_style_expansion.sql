ALTER TABLE app_user
  DROP CONSTRAINT IF EXISTS app_user_avatar_style_check;

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
      'prism',
      'phoenix',
      'nova',
      'rocket',
      'shieldstar'
    )
  );

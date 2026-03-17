ALTER TABLE app_user
  DROP CONSTRAINT IF EXISTS app_user_avatar_bg_check;

ALTER TABLE app_user
  DROP CONSTRAINT IF EXISTS app_user_avatar_accent_check;

ALTER TABLE app_user
  DROP CONSTRAINT IF EXISTS app_user_avatar_border_check;

ALTER TABLE app_user
  ADD CONSTRAINT app_user_avatar_bg_check
  CHECK (
    avatar_bg IN (
      'sky',
      'teal',
      'emerald',
      'lime',
      'amber',
      'orange',
      'red',
      'rose',
      'pink',
      'slate',
      'indigo',
      'violet'
    )
  );

ALTER TABLE app_user
  ADD CONSTRAINT app_user_avatar_accent_check
  CHECK (
    avatar_accent IN (
      'sky',
      'teal',
      'emerald',
      'lime',
      'amber',
      'orange',
      'red',
      'rose',
      'pink',
      'slate',
      'indigo',
      'violet'
    )
  );

ALTER TABLE app_user
  ADD CONSTRAINT app_user_avatar_border_check
  CHECK (
    avatar_border IN (
      'sky',
      'teal',
      'emerald',
      'lime',
      'amber',
      'orange',
      'red',
      'rose',
      'pink',
      'slate',
      'indigo',
      'violet'
    )
  );

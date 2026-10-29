CREATE TABLE "announcement_reads" (
	"announcement_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_reads_announcement_id_user_id_pk" PRIMARY KEY("announcement_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "announcement_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"announcement_id" uuid NOT NULL,
	"thread_guardian_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "announcement_replies_body_len" CHECK (char_length("announcement_replies"."body") <= 2000)
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"group_id" uuid,
	"session_id" uuid,
	"author_id" uuid NOT NULL,
	"title" varchar(140) NOT NULL,
	"body" text NOT NULL,
	"allow_replies" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "announcements_body_len" CHECK (char_length("announcements"."body") <= 4000)
);
--> statement-breakpoint
CREATE TABLE "student_guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"user_id" uuid,
	"name" varchar(120) NOT NULL,
	"email" varchar(255),
	"phone" varchar(32),
	"relationship" varchar(30),
	"invite_token" varchar(128),
	"invite_expires_at" timestamp with time zone,
	"consent_given_at" timestamp with time zone,
	"consent_version" varchar(20),
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_guardians_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_replies" ADD CONSTRAINT "announcement_replies_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_replies" ADD CONSTRAINT "announcement_replies_thread_guardian_id_student_guardians_id_fk" FOREIGN KEY ("thread_guardian_id") REFERENCES "public"."student_guardians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_replies" ADD CONSTRAINT "announcement_replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcement_replies_thread_idx" ON "announcement_replies" USING btree ("announcement_id","thread_guardian_id","created_at");--> statement-breakpoint
CREATE INDEX "announcements_club_created_idx" ON "announcements" USING btree ("club_id","created_at");--> statement-breakpoint
CREATE INDEX "announcements_group_created_idx" ON "announcements" USING btree ("group_id","created_at");--> statement-breakpoint
CREATE INDEX "student_guardians_student_id_idx" ON "student_guardians" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_guardians_user_id_idx" ON "student_guardians" USING btree ("user_id");--> statement-breakpoint

-- ═══ Avisos club → familias: funciones, triggers, RLS y tiempo real ═══════
-- ---------------------------------------------------------------------
-- 5. Funciones auxiliares (security definer → evitan recursión de RLS)
-- ---------------------------------------------------------------------
create or replace function public.is_club_admin(p_club uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from clubs where id = p_club and owner_id = auth.uid())
      or exists (select 1 from club_members
                 where club_id = p_club and user_id = auth.uid()
                   and role = 'owner' and status = 'active');
$$;--> statement-breakpoint
create or replace function public.is_club_staff(p_club uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_club_admin(p_club)
      or exists (select 1 from club_members
                 where club_id = p_club and user_id = auth.uid() and status = 'active');
$$;--> statement-breakpoint
-- Admin del club, o monitor que lleva ese grupo dentro del club
create or replace function public.can_post_to_group(p_club uuid, p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_club_admin(p_club)
      or exists (select 1 from groups g
                 join club_members cm on cm.club_id = g.club_id
                  and cm.user_id = auth.uid() and cm.status = 'active'
                 where g.id = p_group and g.club_id = p_club and g.coach_id = auth.uid());
$$;--> statement-breakpoint
-- Ids de tutor activos del usuario actual
create or replace function public.my_guardian_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from student_guardians where user_id = auth.uid() and revoked_at is null;
$$;--> statement-breakpoint
-- ¿Puede la familia actual ver este aviso?
create or replace function public.guardian_sees_announcement(p_ann uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from announcements a
    join students s on s.club_id = a.club_id
    join student_guardians sg on sg.student_id = s.id
     and sg.user_id = auth.uid() and sg.revoked_at is null
    where a.id = p_ann and a.deleted_at is null
      and (a.group_id is null
           or exists (select 1 from group_students gs
                      where gs.group_id = a.group_id and gs.student_id = s.id))
  );
$$;--> statement-breakpoint
create or replace function public.announcement_club(p_ann uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select club_id from announcements where id = p_ann;
$$;--> statement-breakpoint
-- Reglas de destino de un aviso (crear y editar)
create or replace function public.can_post_announcement(p_club uuid, p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case when p_group is null then public.is_club_admin(p_club)
              else public.can_post_to_group(p_club, p_group) end;
$$;--> statement-breakpoint
-- Staff que puede leer/contestar los hilos privados de un aviso:
-- admin del club, o el monitor del grupo al que va el aviso.
create or replace function public.can_staff_handle_thread(p_ann uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from announcements a
    where a.id = p_ann
      and (public.is_club_admin(a.club_id)
           or (a.group_id is not null and public.can_post_to_group(a.club_id, a.group_id)))
  );
$$;--> statement-breakpoint
-- Columnas que no se pueden cambiar una vez creado el mensaje
create or replace function public.lock_reply_columns()
returns trigger language plpgsql as $$
begin
  if new.announcement_id    is distinct from old.announcement_id
  or new.thread_guardian_id is distinct from old.thread_guardian_id
  or new.author_id          is distinct from old.author_id then
    raise exception 'No se puede mover ni reasignar un mensaje';
  end if;
  return new;
end $$;--> statement-breakpoint
create or replace function public.lock_announcement_author()
returns trigger language plpgsql as $$
begin
  if new.author_id is distinct from old.author_id then
    raise exception 'No se puede cambiar el autor de un aviso';
  end if;
  new.updated_at := now();
  return new;
end $$;--> statement-breakpoint
drop trigger if exists announcement_replies_lock on public.announcement_replies;--> statement-breakpoint
create trigger announcement_replies_lock before update on public.announcement_replies
  for each row execute function public.lock_reply_columns();--> statement-breakpoint
drop trigger if exists announcements_lock on public.announcements;--> statement-breakpoint
create trigger announcements_lock before update on public.announcements
  for each row execute function public.lock_announcement_author();--> statement-breakpoint
-- ---------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------
alter table public.student_guardians    enable row level security;--> statement-breakpoint
alter table public.announcements        enable row level security;--> statement-breakpoint
alter table public.announcement_replies enable row level security;--> statement-breakpoint
alter table public.announcement_reads   enable row level security;--> statement-breakpoint
-- student_guardians: el staff del club (o el monitor particular dueño del
-- alumno) gestiona; la familia solo ve sus propias filas.
drop policy if exists sg_staff_all on public.student_guardians;--> statement-breakpoint
create policy sg_staff_all on public.student_guardians for all
  using (exists (select 1 from students s where s.id = student_id
                 and (s.coach_id = auth.uid()
                      or (s.club_id is not null and public.is_club_staff(s.club_id)))))
  with check (exists (select 1 from students s where s.id = student_id
                 and (s.coach_id = auth.uid()
                      or (s.club_id is not null and public.is_club_staff(s.club_id)))));--> statement-breakpoint
drop policy if exists sg_self_select on public.student_guardians;--> statement-breakpoint
create policy sg_self_select on public.student_guardians for select
  using (user_id = auth.uid());--> statement-breakpoint
-- La activación de cuenta (invite_token → user_id) se hace en una ruta de
-- servidor con la service role, nunca desde el cliente.

-- announcements
drop policy if exists ann_select on public.announcements;--> statement-breakpoint
create policy ann_select on public.announcements for select
  using (public.is_club_staff(club_id) or public.guardian_sees_announcement(id));--> statement-breakpoint
drop policy if exists ann_insert on public.announcements;--> statement-breakpoint
create policy ann_insert on public.announcements for insert
  with check (
    author_id = auth.uid()
    and public.can_post_announcement(club_id, group_id)
    and (session_id is null
         or exists (select 1 from sessions se
                    where se.id = session_id and se.group_id = announcements.group_id))
  );--> statement-breakpoint
-- Al editar, el nuevo destino tiene que cumplir las mismas reglas que al crear
-- (evita que un monitor reenvíe su aviso al grupo de otro monitor o a otro club).
drop policy if exists ann_update on public.announcements;--> statement-breakpoint
create policy ann_update on public.announcements for update
  using (author_id = auth.uid() or public.is_club_admin(club_id))
  with check (
    (author_id = auth.uid() or public.is_club_admin(club_id))
    and public.can_post_announcement(club_id, group_id)
    and (session_id is null
         or exists (select 1 from sessions se
                    where se.id = session_id and se.group_id = announcements.group_id))
  );--> statement-breakpoint
-- Sin política DELETE: se borra con deleted_at (y purga programada).

-- announcement_replies
drop policy if exists rep_select on public.announcement_replies;--> statement-breakpoint
create policy rep_select on public.announcement_replies for select
  using (
    public.can_staff_handle_thread(announcement_id)
    or thread_guardian_id in (select public.my_guardian_ids())
  );--> statement-breakpoint
drop policy if exists rep_insert on public.announcement_replies;--> statement-breakpoint
create policy rep_insert on public.announcement_replies for insert
  with check (
    author_id = auth.uid()
    and (
      -- el admin o el monitor del grupo contesta en el hilo de una familia
      -- (y la familia tiene que ser destinataria del aviso)
      (public.can_staff_handle_thread(announcement_id)
       and exists (select 1 from student_guardians sg
                   join students s on s.id = sg.student_id
                   join announcements a on a.id = announcement_id and a.club_id = s.club_id
                   where sg.id = thread_guardian_id
                     and (a.group_id is null
                          or exists (select 1 from group_students gs
                                     where gs.group_id = a.group_id and gs.student_id = s.id))))
      or (
        -- la familia escribe en su propio hilo, si el aviso admite respuestas
        thread_guardian_id in (select public.my_guardian_ids())
        and public.guardian_sees_announcement(announcement_id)
        and exists (select 1 from announcements a
                    where a.id = announcement_id and a.allow_replies)
      )
    )
  );--> statement-breakpoint
drop policy if exists rep_update_own on public.announcement_replies;--> statement-breakpoint
create policy rep_update_own on public.announcement_replies for update
  using (author_id = auth.uid()
         or public.is_club_admin(public.announcement_club(announcement_id)));--> statement-breakpoint
-- announcement_reads: cada uno marca lo suyo; el staff ve quién ha leído
drop policy if exists reads_self on public.announcement_reads;--> statement-breakpoint
create policy reads_self on public.announcement_reads for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
              and (public.guardian_sees_announcement(announcement_id)
                   or public.is_club_staff(public.announcement_club(announcement_id))));--> statement-breakpoint
drop policy if exists reads_staff_select on public.announcement_reads;--> statement-breakpoint
create policy reads_staff_select on public.announcement_reads for select
  using (public.is_club_staff(public.announcement_club(announcement_id)));--> statement-breakpoint
-- ---------------------------------------------------------------------
-- 7. Tiempo real (Supabase Realtime respeta las políticas RLS)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'announcements') then
    alter publication supabase_realtime add table public.announcements;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'announcement_replies') then
    alter publication supabase_realtime add table public.announcement_replies;
  end if;
end $$;--> statement-breakpoint

-- ─── Permisos (mismo patrón que 0035_clubs) ────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON student_guardians TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON announcements TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON announcement_replies TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON announcement_reads TO authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION is_club_admin(uuid) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION is_club_admin(uuid) TO authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION is_club_staff(uuid) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION is_club_staff(uuid) TO authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION can_post_to_group(uuid, uuid) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION can_post_to_group(uuid, uuid) TO authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION my_guardian_ids() FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION my_guardian_ids() TO authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION guardian_sees_announcement(uuid) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION guardian_sees_announcement(uuid) TO authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION announcement_club(uuid) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION announcement_club(uuid) TO authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION can_post_announcement(uuid, uuid) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION can_post_announcement(uuid, uuid) TO authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION can_staff_handle_thread(uuid) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION can_staff_handle_thread(uuid) TO authenticated;

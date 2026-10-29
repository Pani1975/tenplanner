CREATE TYPE "public"."announcement_audience" AS ENUM('club', 'group', 'student', 'coaches', 'coach');--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "audience" "announcement_audience" DEFAULT 'group' NOT NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "student_id" uuid;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "recipient_user_id" uuid;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "sport" "sport";--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_student_created_idx" ON "announcements" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "announcements_recipient_created_idx" ON "announcements" USING btree ("recipient_user_id","created_at");--> statement-breakpoint
-- Avisos ya existentes sin grupo eran avisos a todo el club
UPDATE "announcements" SET "audience" = 'club' WHERE "group_id" IS NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_audience_target" CHECK (("announcements"."audience" = 'club' and "announcements"."group_id" is null and "announcements"."student_id" is null and "announcements"."recipient_user_id" is null)
       or ("announcements"."audience" = 'group' and "announcements"."group_id" is not null and "announcements"."student_id" is null and "announcements"."recipient_user_id" is null)
       or ("announcements"."audience" = 'student' and "announcements"."student_id" is not null and "announcements"."group_id" is null and "announcements"."recipient_user_id" is null)
       or ("announcements"."audience" = 'coaches' and "announcements"."group_id" is null and "announcements"."student_id" is null and "announcements"."recipient_user_id" is null)
       or ("announcements"."audience" = 'coach' and "announcements"."recipient_user_id" is not null and "announcements"."group_id" is null and "announcements"."student_id" is null));--> statement-breakpoint

-- ═══ Mensajes del club: monitores, grupo y alumno individual ═══════════════

-- ¿Puede el usuario actual enviar este mensaje?
--   club / coaches / coach → solo el admin del club (coach: el destinatario
--                            tiene que ser monitor activo del club)
--   group                  → admin o monitor del grupo
--   student                → admin o monitor del alumno, y el alumno es del club
CREATE OR REPLACE FUNCTION public.can_send_announcement(
  p_club uuid, p_audience announcement_audience,
  p_group uuid, p_student uuid, p_recipient uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE p_audience
    WHEN 'club'    THEN public.is_club_admin(p_club)
    WHEN 'coaches' THEN public.is_club_admin(p_club)
    WHEN 'coach'   THEN public.is_club_admin(p_club)
                        AND p_recipient IS DISTINCT FROM auth.uid()
                        AND EXISTS (SELECT 1 FROM club_members cm
                                    WHERE cm.club_id = p_club AND cm.user_id = p_recipient
                                      AND cm.role = 'coach' AND cm.status = 'active')
    WHEN 'group'   THEN public.can_post_to_group(p_club, p_group)
    WHEN 'student' THEN EXISTS (SELECT 1 FROM students s
                                WHERE s.id = p_student AND s.club_id = p_club
                                  AND (public.is_club_admin(p_club)
                                       OR (s.coach_id = auth.uid()
                                           AND public.is_club_staff(p_club))))
    ELSE false
  END;
$$;--> statement-breakpoint

-- ¿Es este tutor/contacto destinatario del aviso?
CREATE OR REPLACE FUNCTION public.guardian_is_recipient(p_guardian uuid, p_ann uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM announcements a
    JOIN student_guardians sg ON sg.id = p_guardian AND sg.revoked_at IS NULL
    JOIN students s ON s.id = sg.student_id AND s.club_id = a.club_id
    WHERE a.id = p_ann AND a.deleted_at IS NULL
      AND CASE a.audience
            WHEN 'club'    THEN true
            WHEN 'group'   THEN EXISTS (SELECT 1 FROM group_students gs
                                        WHERE gs.group_id = a.group_id AND gs.student_id = s.id)
            WHEN 'student' THEN s.id = a.student_id
            ELSE false
          END
  );
$$;--> statement-breakpoint

-- La familia actual ve el aviso si alguno de sus contactos es destinatario
CREATE OR REPLACE FUNCTION public.guardian_sees_announcement(p_ann uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM student_guardians sg
    WHERE sg.user_id = auth.uid() AND sg.revoked_at IS NULL
      AND public.guardian_is_recipient(sg.id, p_ann)
  );
$$;--> statement-breakpoint

-- Qué ve el personal del club:
--   admin → todo lo de su club
--   autor → lo suyo
--   monitor → mensajes a todos los monitores (de su deporte), los dirigidos
--             a él, avisos a todo el club, y los de sus grupos y sus alumnos
CREATE OR REPLACE FUNCTION public.staff_sees_announcement(p_ann uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM announcements a
    WHERE a.id = p_ann
      AND (
        public.is_club_admin(a.club_id)
        OR a.author_id = auth.uid()
        OR (a.deleted_at IS NULL AND public.is_club_staff(a.club_id) AND CASE a.audience
              WHEN 'coach'   THEN a.recipient_user_id = auth.uid()
              WHEN 'coaches' THEN a.sport IS NULL OR EXISTS (
                                    SELECT 1 FROM club_members cm
                                    WHERE cm.club_id = a.club_id AND cm.user_id = auth.uid()
                                      AND cm.status = 'active' AND cm.sport = a.sport)
              WHEN 'club'    THEN true
              WHEN 'group'   THEN EXISTS (SELECT 1 FROM groups g
                                          WHERE g.id = a.group_id AND g.coach_id = auth.uid())
              WHEN 'student' THEN EXISTS (SELECT 1 FROM students s
                                          WHERE s.id = a.student_id AND s.coach_id = auth.uid())
              ELSE false
            END)
      )
  );
$$;--> statement-breakpoint

-- Personal que lee/contesta los hilos privados con las familias
CREATE OR REPLACE FUNCTION public.can_staff_handle_thread(p_ann uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM announcements a
    WHERE a.id = p_ann AND a.audience IN ('club', 'group', 'student')
      AND (public.is_club_admin(a.club_id)
           OR (a.audience = 'group' AND public.can_post_to_group(a.club_id, a.group_id))
           OR (a.audience = 'student' AND EXISTS (
                 SELECT 1 FROM students s
                 WHERE s.id = a.student_id AND s.coach_id = auth.uid()
                   AND public.is_club_staff(a.club_id))))
  );
$$;--> statement-breakpoint

-- Menores: el canal es siempre con padres o tutores. Un alumno solo puede ser
-- su propio contacto ("alumno") si consta su fecha de nacimiento y es mayor.
CREATE OR REPLACE FUNCTION public.check_guardian_relationship()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_birth date;
BEGIN
  IF NEW.relationship = 'alumno' THEN
    SELECT birth_date INTO v_birth FROM students WHERE id = NEW.student_id;
    IF v_birth IS NULL OR v_birth > (current_date - interval '18 years') THEN
      RAISE EXCEPTION 'Un alumno menor de edad (o sin fecha de nacimiento) solo puede tener como contacto a sus padres o tutores';
    END IF;
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS student_guardians_relationship ON public.student_guardians;--> statement-breakpoint
CREATE TRIGGER student_guardians_relationship
  BEFORE INSERT OR UPDATE OF relationship, student_id ON public.student_guardians
  FOR EACH ROW EXECUTE FUNCTION public.check_guardian_relationship();--> statement-breakpoint

-- Políticas que cambian
DROP POLICY IF EXISTS ann_select ON public.announcements;--> statement-breakpoint
CREATE POLICY ann_select ON public.announcements FOR SELECT
  USING (public.staff_sees_announcement(id) OR public.guardian_sees_announcement(id));--> statement-breakpoint

DROP POLICY IF EXISTS ann_insert ON public.announcements;--> statement-breakpoint
CREATE POLICY ann_insert ON public.announcements FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND public.can_send_announcement(club_id, audience, group_id, student_id, recipient_user_id)
    AND (session_id IS NULL
         OR (audience = 'group' AND EXISTS (SELECT 1 FROM sessions se
                    WHERE se.id = session_id AND se.group_id = announcements.group_id)))
  );--> statement-breakpoint

DROP POLICY IF EXISTS ann_update ON public.announcements;--> statement-breakpoint
CREATE POLICY ann_update ON public.announcements FOR UPDATE
  USING (author_id = auth.uid() OR public.is_club_admin(club_id))
  WITH CHECK (
    (author_id = auth.uid() OR public.is_club_admin(club_id))
    AND public.can_send_announcement(club_id, audience, group_id, student_id, recipient_user_id)
    AND (session_id IS NULL
         OR (audience = 'group' AND EXISTS (SELECT 1 FROM sessions se
                    WHERE se.id = session_id AND se.group_id = announcements.group_id)))
  );--> statement-breakpoint

DROP POLICY IF EXISTS rep_insert ON public.announcement_replies;--> statement-breakpoint
CREATE POLICY rep_insert ON public.announcement_replies FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND public.guardian_is_recipient(thread_guardian_id, announcement_id)
    AND (
      public.can_staff_handle_thread(announcement_id)
      OR (thread_guardian_id IN (SELECT public.my_guardian_ids())
          AND EXISTS (SELECT 1 FROM announcements a
                      WHERE a.id = announcement_id AND a.allow_replies))
    )
  );--> statement-breakpoint

DROP POLICY IF EXISTS reads_self ON public.announcement_reads;--> statement-breakpoint
CREATE POLICY reads_self ON public.announcement_reads FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid()
              AND (public.guardian_sees_announcement(announcement_id)
                   OR public.staff_sees_announcement(announcement_id)));--> statement-breakpoint

DROP POLICY IF EXISTS reads_staff_select ON public.announcement_reads;--> statement-breakpoint
CREATE POLICY reads_staff_select ON public.announcement_reads FOR SELECT
  USING (public.staff_sees_announcement(announcement_id));--> statement-breakpoint

-- Sustituida por can_send_announcement
DROP FUNCTION IF EXISTS public.can_post_announcement(uuid, uuid);--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION can_send_announcement(uuid, announcement_audience, uuid, uuid, uuid) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION can_send_announcement(uuid, announcement_audience, uuid, uuid, uuid) TO authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION guardian_is_recipient(uuid, uuid) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION guardian_is_recipient(uuid, uuid) TO authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION staff_sees_announcement(uuid) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION staff_sees_announcement(uuid) TO authenticated;

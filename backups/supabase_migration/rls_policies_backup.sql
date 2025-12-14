CREATE POLICY documents_update_policy ON public.documents FOR UPDATE TO authenticated USING ((uploaded_by = auth.uid()));
CREATE POLICY documents_select_policy ON public.documents FOR SELECT TO authenticated USING ((uploaded_by = auth.uid()));
CREATE POLICY documents_insert_policy_permissive ON public.documents FOR INSERT TO anon, authenticated;
CREATE POLICY documents_delete_policy ON public.documents FOR DELETE TO authenticated USING ((uploaded_by = auth.uid()));
CREATE POLICY smart_templates_select_policy ON public.smart_templates FOR SELECT TO anon, authenticated USING (((is_public = true) OR ((auth.uid() IS NOT NULL) AND (created_by = auth.uid()))));
CREATE POLICY smart_templates_insert_policy ON public.smart_templates FOR INSERT TO authenticated;
CREATE POLICY smart_templates_update_policy ON public.smart_templates FOR UPDATE TO authenticated USING ((created_by = auth.uid()));
CREATE POLICY smart_templates_delete_policy ON public.smart_templates FOR DELETE TO authenticated USING ((created_by = auth.uid()));
CREATE POLICY template_embeddings_insert_policy ON public.template_embeddings FOR INSERT TO authenticated;
CREATE POLICY template_embeddings_select_policy ON public.template_embeddings FOR SELECT TO authenticated USING (
CASE
    WHEN (template_type = 'smart'::text) THEN (EXISTS ( SELECT 1
       FROM smart_templates st
      WHERE ((st.id = template_embeddings.template_id) AND ((st.is_public = true) OR (st.created_by = auth.uid())))))
    WHEN (template_type = 'standard'::text) THEN (EXISTS ( SELECT 1
       FROM templates t
      WHERE ((t.id = template_embeddings.template_id) AND ((t.is_public = true) OR (t.created_by = auth.uid())))))
    WHEN (template_type = 'workflow'::text) THEN (EXISTS ( SELECT 1
       FROM workflow_templates wt
      WHERE ((wt.id = template_embeddings.template_id) AND ((wt.is_public = true) OR (wt.created_by = auth.uid())))))
    ELSE false
END);
CREATE POLICY templates_update_policy ON public.templates FOR UPDATE TO authenticated USING ((created_by = auth.uid()));
CREATE POLICY templates_delete_policy ON public.templates FOR DELETE TO authenticated USING ((created_by = auth.uid()));
CREATE POLICY templates_select_policy ON public.templates FOR SELECT TO anon, authenticated USING (((is_public = true) OR ((auth.uid() IS NOT NULL) AND (created_by = auth.uid()))));
CREATE POLICY templates_insert_policy ON public.templates FOR INSERT TO authenticated;
CREATE POLICY workflow_executions_select_policy ON public.workflow_executions FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM workflow_instances wi
  WHERE ((wi.id = workflow_executions.workflow_instance_id) AND (wi.created_by = auth.uid())))));
CREATE POLICY workflow_executions_insert_policy ON public.workflow_executions FOR INSERT TO public;
CREATE POLICY workflow_executions_update_policy ON public.workflow_executions FOR UPDATE TO public USING ((EXISTS ( SELECT 1
   FROM workflow_instances wi
  WHERE ((wi.id = workflow_executions.workflow_instance_id) AND (wi.created_by = auth.uid())))));
CREATE POLICY workflow_executions_delete_policy ON public.workflow_executions FOR DELETE TO public USING ((EXISTS ( SELECT 1
   FROM workflow_instances wi
  WHERE ((wi.id = workflow_executions.workflow_instance_id) AND (wi.created_by = auth.uid())))));
CREATE POLICY workflow_instances_select_policy ON public.workflow_instances FOR SELECT TO authenticated USING ((created_by = auth.uid()));
CREATE POLICY workflow_instances_insert_policy ON public.workflow_instances FOR INSERT TO authenticated;
CREATE POLICY workflow_instances_update_policy ON public.workflow_instances FOR UPDATE TO authenticated USING ((created_by = auth.uid()));
CREATE POLICY workflow_instances_delete_policy ON public.workflow_instances FOR DELETE TO authenticated USING ((created_by = auth.uid()));
CREATE POLICY workflow_templates_delete_policy ON public.workflow_templates FOR DELETE TO authenticated USING ((created_by = auth.uid()));
CREATE POLICY workflow_templates_update_policy ON public.workflow_templates FOR UPDATE TO authenticated USING ((created_by = auth.uid()));
CREATE POLICY workflow_templates_insert_policy ON public.workflow_templates FOR INSERT TO authenticated;
CREATE POLICY workflow_templates_select_policy ON public.workflow_templates FOR SELECT TO anon, authenticated USING (((is_public = true) OR ((auth.uid() IS NOT NULL) AND (created_by = auth.uid()))));

-- Stockage des fichiers de la GED : bucket privé « documents ».
-- Chemin : {org_id}/{document_id}/{identifiant}-{nom_fichier}
-- Pas de politique de modification ni de suppression : les fichiers déposés sont immuables.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents : lecture" on storage.objects for select to authenticated
  using (bucket_id = 'documents'
         and app.niveau(app.uuid_ou_null((storage.foldername(name))[1]), 'documents') >= 1);

create policy "documents : dépôt" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents'
              and app.niveau(app.uuid_ou_null((storage.foldername(name))[1]), 'documents') >= 2);

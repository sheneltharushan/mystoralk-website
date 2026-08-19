-- Least-privilege grants and performance cleanup following the admin foundation.

revoke all on table public.admin_users from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;
revoke all on table public.collections from anon, authenticated;
revoke all on table public.collection_products from anon, authenticated;
revoke all on table public.site_settings from anon, authenticated;

grant select, insert, update, delete on public.admin_users to authenticated;
grant select on public.audit_logs to authenticated;
grant select on public.collections, public.collection_products, public.site_settings to anon;
grant select, insert, update, delete on public.collections, public.collection_products, public.site_settings to authenticated;

revoke all on all sequences in schema public from anon;
grant usage, select on all sequences in schema public to authenticated;

drop policy if exists "Public products are readable" on public.products;
drop policy if exists "Admins can view all products" on public.products;
create policy "Public products are readable"
on public.products for select to anon
using (active is true);
create policy "Authenticated users can view permitted products"
on public.products for select to authenticated
using (active is true or private.is_admin());

drop policy if exists "Public can view active collections" on public.collections;
drop policy if exists "Admins can view all collections" on public.collections;
create policy "Public can view active collections"
on public.collections for select to anon
using (active is true);
create policy "Authenticated users can view permitted collections"
on public.collections for select to authenticated
using (active is true or private.is_admin());

drop policy if exists "Public can view active collection products" on public.collection_products;
drop policy if exists "Admins can view all collection products" on public.collection_products;
create policy "Public can view active collection products"
on public.collection_products for select to anon
using (
  exists (select 1 from public.collections c where c.id = collection_id and c.active is true)
  and exists (select 1 from public.products p where p.id = product_id and p.active is true)
);
create policy "Authenticated users can view permitted collection products"
on public.collection_products for select to authenticated
using (
  private.is_admin()
  or (
    exists (select 1 from public.collections c where c.id = collection_id and c.active is true)
    and exists (select 1 from public.products p where p.id = product_id and p.active is true)
  )
);

drop policy if exists "Public can read public settings" on public.site_settings;
drop policy if exists "Admins can view all settings" on public.site_settings;
create policy "Public can read public settings"
on public.site_settings for select to anon
using (public is true);
create policy "Authenticated users can view permitted settings"
on public.site_settings for select to authenticated
using (public is true or private.is_admin());

drop policy if exists "No direct browser access to orders" on public.orders;
create policy "No anonymous browser access to orders"
on public.orders for all to anon
using (false) with check (false);

create index if not exists admin_users_updated_by_idx on public.admin_users(updated_by);
create index if not exists audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index if not exists collection_products_product_id_idx on public.collection_products(product_id);
create index if not exists collections_updated_by_idx on public.collections(updated_by);
create index if not exists orders_assigned_to_idx on public.orders(assigned_to);
create index if not exists orders_product_id_idx on public.orders(product_id);
create index if not exists orders_updated_by_idx on public.orders(updated_by);
create index if not exists products_updated_by_idx on public.products(updated_by);
create index if not exists site_settings_updated_by_idx on public.site_settings(updated_by);
create index if not exists orders_status_updated_at_idx on public.orders(status, updated_at desc);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);

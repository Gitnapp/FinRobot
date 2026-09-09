# @gitnapp/web-shell

Application shell primitives with router-independent links. Wrap in `ShellLinkProvider` to use the application's router.

0.4.0 adds `RailBreadcrumb` with ordered `{label,href?}` items. Ancestors use the link provider; the final item is a non-interactive current page. The host supplies route metadata and displays it in desktop and mobile headers.

Sidebar typography distinguishes brand, normal links and active links without increasing visual density. UI dependency is released together with @gitnapp/ui 0.3.0.

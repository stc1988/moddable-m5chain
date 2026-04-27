declare module "mod/config" {
	var Config: { file: { root: string } } & Record<string, unknown>;

	export { Config as default };
}

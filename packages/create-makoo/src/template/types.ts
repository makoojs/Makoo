export type InitData = {
	projectName: string;
	scriptName: string;
	version: string;
	nameSpace: string;
	userScriptMatch: string;
	variant: string;
	framework: MakooFramework;
	dependencyMode: 'npm' | 'local';
};
export type MakooFramework = 'Vue' | 'React';

export type MakooDependencyResult = {
	dependencies: Record<string, string>;
	devDependencies: Record<string, string>;
};
export type TsconfigTemplateOptions = {
	appInclude: string[];
	nodeInclude: string[];
	appTypes?: string[];
	appCompilerOptions?: Record<string, unknown>;
};

export type TemplateAsset = {
	source: string;
	target: string;
};

export type DependencyMode = 'npm' | 'local';

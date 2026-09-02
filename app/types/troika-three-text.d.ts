declare module "troika-three-text" {
    interface TextBuilderConfig {
        useWorker?: boolean;
    }

    export function configureTextBuilder(config: TextBuilderConfig): void;
}

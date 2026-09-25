export interface StateView<T> {
	getSnapshot(): Readonly<T>;
	subscribe(notify: () => void): () => void;
}

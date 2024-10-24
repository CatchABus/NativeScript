
/**
 * @since 13.0
 */
declare const enum LPErrorCode {

	Unknown = 1,

	MetadataFetchFailed = 2,

	MetadataFetchCancelled = 3,

	MetadataFetchTimedOut = 4,

	MetadataFetchNotAllowed = 5
}

/**
 * @since 13.0
 */
declare var LPErrorDomain: string;

/**
 * @since 13.0
 */
declare class LPLinkMetadata extends NSObject implements NSCopying, NSSecureCoding {

	static alloc(): LPLinkMetadata; // inherited from NSObject

	static new(): LPLinkMetadata; // inherited from NSObject

	URL: NSURL;

	iconProvider: NSItemProvider;

	imageProvider: NSItemProvider;

	originalURL: NSURL;

	remoteVideoURL: NSURL;

	title: string;

	videoProvider: NSItemProvider;

	static readonly supportsSecureCoding: boolean; // inherited from NSSecureCoding

	constructor(o: { coder: NSCoder; }); // inherited from NSCoding

	copyWithZone(zone: interop.Pointer | interop.Reference<any>): any;

	encodeWithCoder(coder: NSCoder): void;

	initWithCoder(coder: NSCoder): this;
}

/**
 * @since 13.0
 */
declare class LPLinkView extends UIView {

	static alloc(): LPLinkView; // inherited from NSObject

	static appearance(): LPLinkView; // inherited from UIAppearance

	/**
	 * @since 8.0
	 */
	static appearanceForTraitCollection(trait: UITraitCollection): LPLinkView; // inherited from UIAppearance

	/**
	 * @since 8.0
	 * @deprecated 9.0
	 */
	static appearanceForTraitCollectionWhenContainedIn(trait: UITraitCollection, ContainerClass: typeof NSObject): LPLinkView; // inherited from UIAppearance

	/**
	 * @since 9.0
	 */
	static appearanceForTraitCollectionWhenContainedInInstancesOfClasses(trait: UITraitCollection, containerTypes: NSArray<typeof NSObject> | typeof NSObject[]): LPLinkView; // inherited from UIAppearance

	/**
	 * @since 5.0
	 * @deprecated 9.0
	 */
	static appearanceWhenContainedIn(ContainerClass: typeof NSObject): LPLinkView; // inherited from UIAppearance

	/**
	 * @since 9.0
	 */
	static appearanceWhenContainedInInstancesOfClasses(containerTypes: NSArray<typeof NSObject> | typeof NSObject[]): LPLinkView; // inherited from UIAppearance

	static new(): LPLinkView; // inherited from NSObject

	metadata: LPLinkMetadata;

	constructor(o: { metadata: LPLinkMetadata; });

	constructor(o: { URL: NSURL; });

	initWithMetadata(metadata: LPLinkMetadata): this;

	initWithURL(URL: NSURL): this;
}

/**
 * @since 13.0
 */
declare class LPMetadataProvider extends NSObject {

	static alloc(): LPMetadataProvider; // inherited from NSObject

	static new(): LPMetadataProvider; // inherited from NSObject

	shouldFetchSubresources: boolean;

	timeout: number;

	cancel(): void;

	/**
	 * @since 15.0
	 */
	startFetchingMetadataForRequestCompletionHandler(request: NSURLRequest, completionHandler: (p1: LPLinkMetadata, p2: NSError) => void): void;

	startFetchingMetadataForURLCompletionHandler(URL: NSURL, completionHandler: (p1: LPLinkMetadata, p2: NSError) => void): void;
}

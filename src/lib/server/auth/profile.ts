/** Identity as returned by the OIDC provider, decoupled from the client library. */
export interface Profile {
	issuer: string;
	subject: string;
	email: string;
	name: string;
	picture: string;
}

import {DIDResolutionResult} from 'did-resolver';
/**
 * This did:ethr resolver instructs the did-jwt machinery to use the
 * EcdsaSecp256k1RecoveryMethod2020Uses verification method which adds the recovery bit to the
 * signature to recover the DID's public key from a signature.
 *
 * This effectively hard codes the did:ethr DID resolver to use the address as the public key.
 * @param did : string
 * @returns {Promise<DIDResolutionResult>}
 *
 * Similar code resides in crowd-funder-for-time-pwa and image-api
 */
export const didEthLocalResolver = async (did) => {
  const didRegex = /^did:ethr:(0x[0-9a-fA-F]{40})$/;
  const match = did.match(didRegex);

  if (match) {
    const address = match[1]; // Extract eth address: 0x...
    const publicKeyHex = address; // Use the address directly as a public key placeholder

    return {
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: "application/did+ld+json"
      },
      didDocument: {
        '@context': [
          'https://www.w3.org/ns/did/v1',
          "https://w3id.org/security/suites/secp256k1recovery-2020/v2"
        ],
        id: did,
        verificationMethod: [{
          id: `${did}#controller`,
          type: 'EcdsaSecp256k1RecoveryMethod2020',
          controller: did,
          blockchainAccountId: "eip155:1:" + publicKeyHex,
        }],
        authentication: [`${did}#controller`],
        assertionMethod: [`${did}#controller`],
      },
    };
  }

  throw new Error(`Unsupported DID format: ${did}`);
}

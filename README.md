# BlockApps connector

This connector allows Loopback models to communicate with the
[BlockApps STRATO API](http://blockapps.net/strato-api/1.2).

Usage:

1. Create a data source with the `blockapps` connector. The data source  
   should have two settings: `profile`, and `privateKey`, for example:

   ```json
   {
     "blockapps": {
       "name": "blockapps",
       "connector": "blockapps",
       "profile": {
         "name": "strato-dev",
         "url": "http://55.55.55.55"
       },
       "privateKey": "1234512345123451234512345123451234512345123451234512345123451234"
     }
   }
   ```

2. Create a model for the contract you wish to use. The model should have a  
   `blockchain` subsection in its JSON definition:

   ```json
   {
     "name": "BadgerToken",
     "plural": "badger-tokens",
     "base": "Model",
     "idInjection": false,
     "options": {
       "validateUpsert": true
     },
     "properties": {},
     "validations": [],
     "relations": {},
     "acls": [],
     "methods": {},
     "blockchain": {
       "contract": "example/badger-token.compiled.json"
     }
   }
   ```

   The `blockchain` subsection should have a single setting, `contract`, which  
   should point to a file that contains the JSON blob produced by compiling a  
   Solidity contract using the BlockApps' `bloc` tool.

3. The model will expose multiple remote methods. For example, in the above  
   example model entitled `BadgerToken`, you would see:
  - `POST /badger-tokens`: this creates a new instance of the contract
  - `POST /badger-tokens/{id}/method1`: call method1
  - `POST /badger-tokens/{id}/method1`: call method2
  - ... and so on for each method exposed by the contract

    The `id` is the hex-formatted address of the contract. All of the above POST  
    calls take the same format for the POST body:
  
    ```json
    {
      "args": {
         ... # arguments to the contract method
      },
      "txParams": {
        "gasPrice": ...,
        "gasLimit": ...,
        "value": ...
      }
    }
    ```
  
    The `txParams` section is optional.

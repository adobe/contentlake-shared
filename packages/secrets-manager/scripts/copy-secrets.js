/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import {
  CreateSecretCommand,
  GetSecretValueCommand,
  ListSecretsCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

if (!process.argv[2] || !process.argv[3]) {
  console.error(
    'Use: node ./scripts/rename-secrets.js [old-prefix] [new-prefix]',
  );
}

const secretManager = new SecretsManagerClient();

let res = await secretManager.send(
  new ListSecretsCommand({
    IncludePlannedDeletion: false,
    Filters: [{ Key: 'name', Values: [process.argv[2]] }],
  }),
);
while (res.NextToken && res.SecretList) {
  // eslint-disable-next-line no-await-in-loop
  await Promise.all(
    res.SecretList?.map(async (secret) => {
      const newName = secret.Name.replace(process.argv[2], process.argv[3]);
      console.log(`Copying secret ${secret.Name} to ${newName}`);

      const valueRes = await secretManager.send(
        new GetSecretValueCommand({ SecretId: secret.Name }),
      );
      secretManager.send(
        new CreateSecretCommand({
          Name: newName,
          SecretString: valueRes.SecretString,
        }),
      );
    }),
  );
  // eslint-disable-next-line no-await-in-loop
  res = await secretManager.send(
    new ListSecretsCommand({
      IncludePlannedDeletion: false,
      NextToken: res.NextToken,
    }),
  );
}

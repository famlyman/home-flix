name: Deploy Supabase Function
on:
  push:
    branches: [main]
    paths: ['supabase/functions/premiumize-proxy.tsx']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: '18' }
      - run: npm install -g supabase@1.136.3
      - env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_REF: ajkjsezdaulybvrscoyv
        run: supabase functions deploy premiumize-proxy --project-ref $SUPABASE_PROJECT_REF
        working-directory: ./supabase/functions
        // forcing again
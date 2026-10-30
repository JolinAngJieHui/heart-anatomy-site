"""Run with the bundled workspace Python; no HTTP requests are made."""
import importlib.util
from pathlib import Path
import unittest
import sys
sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('reference_fetch', Path(__file__).resolve().parents[1] / 'scripts/fetch-reference-metadata.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class LicenseTests(unittest.TestCase):
    def test_concatenated_uri(self):
        uri = module.license_uri(None, 'https://creativecommons.org/licenses/by/4.0/This is an open access article')
        self.assertEqual(uri, 'https://creativecommons.org/licenses/by/4.0/')
        self.assertTrue(module.permitted(uri))

    def test_explicit_attribution_version(self):
        uri = module.license_uri(None, 'Creative Commons Attribution License CC-BY 4.0., which permits unrestricted use')
        self.assertEqual(uri, 'https://creativecommons.org/licenses/by/4.0/')

    def test_unspecified_version_not_invented(self):
        uri = module.license_uri(None, 'Creative Commons Attribution License, which permits unrestricted use, distribution, and reproduction')
        self.assertEqual(uri, 'https://creativecommons.org/licenses/by/')
        self.assertTrue(module.permitted(uri))

    def test_noncommercial_noderivatives_remain_excluded(self):
        for variant in ['by-nc', 'by-nc-nd', 'by-nd', 'by-nc-sa']:
            self.assertFalse(module.permitted(module.license_uri(f'https://creativecommons.org/licenses/{variant}/4.0/This', '')))
        self.assertIsNone(module.license_uri(None, 'Creative Commons Attribution License NonCommercial, which permits unrestricted use'))

    def test_missing_grant_stays_unverified(self):
        self.assertIsNone(module.license_uri(None, 'Open access. All rights reserved.'))
        self.assertIsNone(module.license_uri(None, 'Creative Commons Attribution License'))

    def test_by_sa(self):
        self.assertTrue(module.permitted(module.license_uri('https://creativecommons.org/licenses/by-sa/4.0/', '')))

if __name__ == '__main__':
    unittest.main()

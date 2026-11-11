package com.sis.cyberfortress

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.viewmodel.compose.viewModel
import com.sis.cyberfortress.ui.navigation.SisNavGraph
import com.sis.cyberfortress.ui.theme.SisCyberFortressTheme
import com.sis.cyberfortress.ui.viewmodel.FortressViewModel

class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            SisCyberFortressTheme {
                val vm: FortressViewModel = viewModel()
                SisNavGraph(viewModel = vm)
            }
        }
    }
}
